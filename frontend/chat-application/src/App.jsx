import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Chat from './Pages/Chat';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';


function App() {


  return (
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/chat" element={<Chat />}/>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </Router>
  );
}

export default App;