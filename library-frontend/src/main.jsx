import ReactDOM from 'react-dom/client'
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  HttpLink,
} from '@apollo/client'

import App from './App'

const httpLink = new HttpLink({
  uri: 'http://localhost:4000/',
})

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: httpLink,
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>
)