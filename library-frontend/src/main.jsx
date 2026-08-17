import ReactDOM from 'react-dom/client'
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  HttpLink,
  ApolloLink,
} from '@apollo/client'

import App from './App'

const httpLink = new HttpLink({
  uri: 'http://localhost:4000/',
})

const authLink = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem('library-user-token')

  operation.setContext({
    headers: {
      authorization: token ? `Bearer ${token}` : '',
    },
  })

  return forward(operation)
})

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: authLink.concat(httpLink),
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>
)