import { useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'

const ALL_AUTHORS = gql`
  query {
    allAuthors {
      name
      born
      bookCount
    }
  }
`

const EDIT_AUTHOR = gql`
  mutation editAuthor($name: String!, $setBornTo: Int!) {
    editAuthor(name: $name, setBornTo: $setBornTo) {
      name
      born
    }
  }
`

const Authors = (props) => {
  const result = useQuery(ALL_AUTHORS)

  const [editAuthor] = useMutation(EDIT_AUTHOR, {
    refetchQueries: [{ query: ALL_AUTHORS }],
  })

  const [name, setName] = useState('')
  const [born, setBorn] = useState('')

  if (!props.show) {
    return null
  }

  if (result.loading) {
    return <div>loading...</div>
  }

  const authors = result.data.allAuthors

  const submit = async (event) => {
    event.preventDefault()

    await editAuthor({
      variables: {
        name,
        setBornTo: Number(born),
      },
    })

    setName('')
    setBorn('')
  }

  return (
 
  <div>
    <h2>authors</h2>

    <table>
      <tbody>
        <tr>
          <th></th>
          <th>born</th>
          <th>books</th>
        </tr>

        {authors.map((a) => (
          <tr key={a.name}>
            <td>{a.name}</td>
            <td>{a.born}</td>
            <td>{a.bookCount}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <h3>Set birth year</h3>

    <form onSubmit={submit}>
      <label>
        author
        <select
          value={name}
          onChange={({ target }) => setName(target.value)}
        >
          <option value="">select author</option>

          {authors.map((author) => (
            <option key={author.name} value={author.name}>
              {author.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        born
        <input
          type="number"
          value={born}
          onChange={({ target }) => setBorn(target.value)}
        />
      </label>

      <button type="submit">update author</button>
    </form>
  </div>
)
}

export default Authors