import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/Login';
import ProfileSetup from './pages/ProfileSetup';
import OfficerSetup from './pages/OfficerSetup';
import ResetPassword from './pages/ResetPassword';

const publicRouter = createBrowserRouter([
  {
    path: '/',
    element: <LoginPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/profile-setup',
    element: <ProfileSetup />,
  },
  {
    path: '/officer-setup',
    element: <OfficerSetup />,
  },
  {
    path: '/reset-password',
    element: <ResetPassword />,
  },
]);

const protectedRouter = createBrowserRouter([
  {
    path: '/app',
    element: <Layout />,
    children: [
      { index: true, element: <Layout /> },
      { path: 'dashboard', element: <Layout /> },
      { path: 'applications', element: <Layout /> },
      { path: 'commodity', element: <Layout /> },
      { path: 'regular', element: <Layout /> },
      { path: 'shortterm', element: <Layout /> },
      { path: 'members', element: <Layout /> },
      { path: 'payments', element: <Layout /> },
      { path: 'treasurer', element: <Layout /> },
      { path: 'settings', element: <Layout /> },
      { path: 'member-home', element: <Layout /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={publicRouter} />;
}
