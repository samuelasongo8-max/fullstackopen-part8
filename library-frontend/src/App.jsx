import { useState } from 'react'
import Authors from './components/Authors'
import Books from './components/Books'
import NewBook from './components/NewBook'
import LoginForm from './components/LoginForm'

const App = () => {
  const [page, setPage] = useState('authors')

  const [token, setToken] = useState(
    localStorage.getItem('library-user-token')
  )

  const logout = () => {
    setToken(null)
    localStorage.removeItem('library-user-token')
    setPage('authors')
  }

  return (
    <div>
      <button onClick={() => setPage('authors')}>
        authors
      </button>

      <button onClick={() => setPage('books')}>
        books
      </button>

      {!token && (
        <button onClick={() => setPage('login')}>
          login
        </button>
      )}

      {token && (
        <>
          <button onClick={() => setPage('add')}>
            add book
          </button>

          <button onClick={() => setPage('recommendations')}>
            recommend
          </button>

          <button onClick={logout}>
            logout
          </button>
        </>
      )}

      <Authors
        show={page === 'authors'}
        token={token}
      />

      <Books
        show={page === 'books'}
        recommendations={false}
        token={token}
      />

      <Books
        show={page === 'recommendations'}
        recommendations={true}
        token={token}
      />

      <NewBook
        show={page === 'add' && !!token}
        token={token}
      />

      <LoginForm
        show={page === 'login'}
        setToken={setToken}
        setPage={setPage}
      />
    </div>
  )
}

export default App