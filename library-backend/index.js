require('dotenv').config()

const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')

const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { GraphQLError } = require('graphql')

const Book = require('./models/Book')
const Author = require('./models/Author')
const User = require('./models/User')

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
`

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

        return Book.findById(book._id).populate('author')
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
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

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

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB')

    return startStandaloneServer(server, {
      listen: {
        port: 4000,
      },

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
  })
  .then(({ url }) => {
    console.log(`Server ready at ${url}`)
  })
  .catch((error) => {
    console.error('Server startup failed')
    console.error(`Error type: ${error.name}`)
    console.error(`Error message: ${error.message}`)
  })