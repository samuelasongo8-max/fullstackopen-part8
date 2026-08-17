require('dotenv').config()

const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const express = require('express')
const cors = require('cors')
const { createServer } = require('http')

const { ApolloServer } = require('@apollo/server')
const { expressMiddleware } = require('@apollo/server/express4')
const {
  ApolloServerPluginDrainHttpServer,
} = require('@apollo/server/plugin/drainHttpServer')

const { GraphQLError } = require('graphql')
const { makeExecutableSchema } = require('@graphql-tools/schema')
const { WebSocketServer } = require('ws')
const { useServer } = require('graphql-ws/use/ws')

const Book = require('./models/Book')
const Author = require('./models/Author')
const User = require('./models/User')


// -------------------------
// GraphQL schema
// -------------------------

const typeDefs = `
  type Book {
    title: String!
    published: Int!
    author: Author!
    genres: [String!]!
    id: ID!
  }

  type Author {
    name: String!
    born: Int
    bookCount: Int!
  }

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
    me: User
  }

  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String!]!
    ): Book!

    editAuthor(name: String!, setBornTo: Int!): Author

    createUser(
      username: String!
      favoriteGenre: String!
    ): User

    login(
      username: String!
      password: String!
    ): Token
  }

  type Subscription {
    bookAdded: Book!
  }
`


// -------------------------
// Simple PubSub
// -------------------------

const subscribers = new Set()

const subscribeToBookAdded = async function* () {
  const queue = []

  const subscriber = {
    queue,
    resolve: null,
  }

  subscribers.add(subscriber)

  try {
    while (true) {
      if (queue.length > 0) {
        yield {
          bookAdded: queue.shift(),
        }
      } else {
        await new Promise((resolve) => {
          subscriber.resolve = resolve
        })
      }
    }
  } finally {
    subscribers.delete(subscriber)
  }
}


const publishBookAdded = (book) => {
  subscribers.forEach((subscriber) => {
    subscriber.queue.push(book)

    if (subscriber.resolve) {
      subscriber.resolve()
      subscriber.resolve = null
    }
  })
}


// -------------------------
// Resolvers
// -------------------------

const resolvers = {
  Query: {
    bookCount: async () => {
      return Book.countDocuments()
    },

    authorCount: async () => {
      return Author.countDocuments()
    },

    allBooks: async (root, args) => {
      const filter = {}

      if (args.author) {
        const author = await Author.findOne({
          name: args.author,
        })

        if (!author) {
          return []
        }

        filter.author = author._id
      }

      if (args.genre) {
        filter.genres = args.genre
      }

      return Book.find(filter).populate('author')
    },

    allAuthors: async () => {
      const authors = await Author.find({})

      return Promise.all(
        authors.map(async (author) => ({
          ...author.toObject(),

          bookCount: await Book.countDocuments({
            author: author._id,
          }),
        }))
      )
    },

    me: async (root, args, context) => {
      if (!context.currentUser) {
        return null
      }

      return User.findById(context.currentUser.id)
    },
  },


  // -------------------------
  // Mutations
  // -------------------------

  Mutation: {
    createUser: async (root, args) => {
      try {
        const user = new User({
          username: args.username,
          favoriteGenre: args.favoriteGenre,
          passwordHash: 'secret',
        })

        await user.save()

        return user
      } catch (error) {
        throw new GraphQLError('Creating user failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
          },
        })
      }
    },


    login: async (root, args) => {
      const user = await User.findOne({
        username: args.username,
      })

      if (!user || args.password !== 'secret') {
        throw new GraphQLError('Wrong credentials', {
          extensions: {
            code: 'BAD_USER_INPUT',
          },
        })
      }

      const userForToken = {
        username: user.username,
        id: user._id.toString(),
      }

      return {
        value: jwt.sign(
          userForToken,
          process.env.JWT_SECRET
        ),
      }
    },


    addBook: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError('not authenticated', {
          extensions: {
            code: 'UNAUTHENTICATED',
          },
        })
      }

      try {
        let author = await Author.findOne({
          name: args.author,
        })

        if (!author) {
          author = new Author({
            name: args.author,
          })

          await author.save()
        }

        const book = new Book({
          title: args.title,
          published: args.published,
          author: author._id,
          genres: args.genres,
        })

        await book.save()

        const savedBook = await Book
          .findById(book._id)
          .populate('author')


        // Publish the new book
        publishBookAdded(savedBook)

        return savedBook
      } catch (error) {
        throw new GraphQLError('Adding book failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
          },
        })
      }
    },


    editAuthor: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError('not authenticated', {
          extensions: {
            code: 'UNAUTHENTICATED',
          },
        })
      }

      try {
        const author = await Author.findOne({
          name: args.name,
        })

        if (!author) {
          return null
        }

        author.born = args.setBornTo

        await author.save()

        return {
          ...author.toObject(),

          bookCount: await Book.countDocuments({
            author: author._id,
          }),
        }
      } catch (error) {
        throw new GraphQLError('Updating author failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
          },
        })
      }
    },
  },


  // -------------------------
  // Subscription
  // -------------------------

  Subscription: {
    bookAdded: {
      subscribe: subscribeToBookAdded,
    },
  },
}


// -------------------------
// Create executable schema
// -------------------------

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})


// -------------------------
// Environment checks
// -------------------------

if (!process.env.MONGODB_URI) {
  console.error(
    'MongoDB connection failed: MONGODB_URI is not set in .env'
  )

  process.exit(1)
}

if (!process.env.JWT_SECRET) {
  console.error(
    'JWT authentication failed: JWT_SECRET is not set in .env'
  )

  process.exit(1)
}


// -------------------------
// Start server
// -------------------------

const app = express()
const httpServer = createServer(app)


// -------------------------
// WebSocket server
// -------------------------

const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/subscriptions',
})

const serverCleanup = useServer(
  {
    schema,

    context: async (ctx) => {
      const connectionParams =
        ctx.connectionParams || {}

      const auth =
        connectionParams.authorization ||
        connectionParams.Authorization

      if (
        auth &&
        typeof auth === 'string' &&
        auth.toLowerCase().startsWith('bearer ')
      ) {
        const token = auth.substring(7)

        try {
          const decodedToken = jwt.verify(
            token,
            process.env.JWT_SECRET
          )

          return {
            currentUser: decodedToken,
          }
        } catch (error) {
          return {}
        }
      }

      return {}
    },
  },
  wsServer
)


// -------------------------
// Apollo Server
// -------------------------

const server = new ApolloServer({
  schema,

  plugins: [
    ApolloServerPluginDrainHttpServer({
      httpServer,
    }),

    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose()
          },
        }
      },
    },
  ],
})


// -------------------------
// Start everything
// -------------------------

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB')

    await server.start()

    app.use(
      '/graphql',
      cors(),
      express.json(),

      expressMiddleware(server, {
        context: async ({ req }) => {
          const auth = req.headers.authorization

          if (
            auth &&
            auth.toLowerCase().startsWith('bearer ')
          ) {
            const token = auth.substring(7)

            try {
              const decodedToken = jwt.verify(
                token,
                process.env.JWT_SECRET
              )

              return {
                currentUser: decodedToken,
              }
            } catch (error) {
              return {}
            }
          }

          return {}
        },
      })
    )

    httpServer.listen(4000, () => {
      console.log(
        'Server ready at http://localhost:4000/graphql'
      )

      console.log(
        'Subscriptions ready at ws://localhost:4000/subscriptions'
      )
    })
  })
  .catch((error) => {
    console.error('Server startup failed')
    console.error(`Error type: ${error.name}`)
    console.error(`Error message: ${error.message}`)
  })