import { useState } from 'react'
import { gql, useMutation } from '@apollo/client'

const LOGIN = gql`
  mutation login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      value
    }
  }
`

const LoginForm = ({ setToken, setPage }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [login] = useMutation(LOGIN, {
    onError: (error) => {
      console.log(error)
    },
    onCompleted: (data) => {
      const token = data.login.value

      setToken(token)
      localStorage.setItem('library-user-token', token)

      setUsername('')
      setPassword('')

      setPage('authors')
    },
  })

  const submit = async (event) => {
    event.preventDefault()

    login({
      variables: {
        username,
        password,
      },
    })
  }

  return (
    <div>
      <h2>Log in</h2>

      <form onSubmit={submit}>
        <div>
          username
          <input
            value={username}
            onChange={({ target }) => setUsername(target.value)}
          />
        </div>

        <div>
          password
          <input
            type="password"
            value={password}
            onChange={({ target }) => setPassword(target.value)}
          />
        </div>

        <button type="submit">login</button>
      </form>
    </div>
  )
}

export default LoginForm