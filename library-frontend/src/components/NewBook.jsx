import { useState } from 'react'
import { gql, useMutation } from '@apollo/client'

const ALL_BOOKS = gql`
  query {
    allBooks {
      title
      published
      genres
      author {
        name
      }
    }
  }
`

const CREATE_BOOK = gql`
  mutation createBook(
    $title: String!
    $author: String!
    $published: Int!
    $genres: [String!]!
  ) {
    addBook(
      title: $title
      author: $author
      published: $published
      genres: $genres
    ) {
      title
      published
      genres
      author {
        name
      }
    }
  }
`

const NewBook = ({ show }) => {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [published, setPublished] = useState('')
  const [genre, setGenre] = useState('')
  const [genres, setGenres] = useState([])

  const [createBook] = useMutation(CREATE_BOOK, {
    refetchQueries: [{ query: ALL_BOOKS }],
  })

  if (!show) {
    return null
  }

  const submit = async (event) => {
    event.preventDefault()

    createBook({
      variables: {
        title,
        author,
        published: Number(published),
        genres,
      },
    })

    setTitle('')
    setAuthor('')
    setPublished('')
    setGenre('')
    setGenres([])
  }

  const addGenre = () => {
    if (genre && !genres.includes(genre)) {
      setGenres(genres.concat(genre))
      setGenre('')
    }
  }

  return (
    <div>
      <h2>add book</h2>

      <form onSubmit={submit}>
        <div>
          title
          <input
            value={title}
            onChange={({ target }) => setTitle(target.value)}
          />
        </div>

        <div>
          author
          <input
            value={author}
            onChange={({ target }) => setAuthor(target.value)}
          />
        </div>

        <div>
          published
          <input
            type="number"
            value={published}
            onChange={({ target }) => setPublished(target.value)}
          />
        </div>

        <div>
          genre
          <input
            value={genre}
            onChange={({ target }) => setGenre(target.value)}
          />
          <button type="button" onClick={addGenre}>
            add genre
          </button>
        </div>

        <div>
          <strong>genres:</strong> {genres.join(', ')}
        </div>

        <button type="submit">create book</button>
      </form>
    </div>
  )
}

export default NewBook