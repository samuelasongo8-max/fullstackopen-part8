require('dotenv').config()

const mongoose = require('mongoose')
const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { GraphQLError } = require('graphql')

const Book = require('./models/Book')
const Author = require('./models/Author')

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

type Query {
  bookCount: Int!
  authorCount: Int!
  allBooks(author: String, genre: String): [Book!]!
  allAuthors: [Author!]!
}

type Mutation {
  addBook(
    title: String!
    author: String!
    published: Int!
    genres: [String!]!
  ): Book!

  editAuthor(name: String!, setBornTo: Int!): Author
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
  },

  Mutation: {
    addBook: async (root, args) => {
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

    editAuthor: async (root, args) => {
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

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB')

    return startStandaloneServer(server, {
      listen: { port: 4000 },
    })
  })
  .then(({ url }) => {
    console.log(`Server ready at ${url}`)
  })
  .catch((error) => {
    console.error('MongoDB connection failed')
    console.error(`Error type: ${error.name}`)
    console.error(`Error message: ${error.message}`)
  })