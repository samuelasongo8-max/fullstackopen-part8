import { gql, useQuery } from '@apollo/client'
import { useState } from 'react'

const ALL_BOOKS = gql`
  query allBooks($genre: String) {
    allBooks(genre: $genre) {
      title
      author {
        name
      }
      published
      genres
      id
    }
  }
`

const ME = gql`
  query {
    me {
      username
      favoriteGenre
    }
  }
`

const Books = (props) => {
  const [genre, setGenre] = useState(null)

  const booksResult = useQuery(ALL_BOOKS, {
    variables: {
      genre: props.recommendations ? null : genre,
    },
  })

  const meResult = useQuery(ME)

  if (!props.show) {
    return null
  }

  if (booksResult.loading || meResult.loading) {
    return <div>loading...</div>
  }

  if (booksResult.error) {
    return (
      <div>
        Error loading books: {booksResult.error.message}
      </div>
    )
  }

  const books = booksResult.data.allBooks
  const user = meResult.data.me

  const genres = [
    ...new Set(books.flatMap((book) => book.genres)),
  ]

  return (
    <div>
      <h2>books</h2>

      {props.recommendations && user && (
        <h3>
          books in your favourite genre: {user.favoriteGenre}
        </h3>
      )}

      {!props.recommendations && genre && (
        <h3>in genre {genre}</h3>
      )}

      <table>
        <tbody>
          <tr>
            <th>title</th>
            <th>author</th>
            <th>published</th>
          </tr>

          {books.map((book) => (
            <tr key={book.id}>
              <td>{book.title}</td>
              <td>{book.author.name}</td>
              <td>{book.published}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!props.recommendations && (
        <div>
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => setGenre(genre)}
            >
              {genre}
            </button>
          ))}

          <button onClick={() => setGenre(null)}>
            all genres
          </button>
        </div>
      )}
    </div>
  )
}

export default Books