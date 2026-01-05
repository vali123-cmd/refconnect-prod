import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PostProvider } from './context/PostContext';
import { FollowProvider } from './context/FollowContext';
import { MatchProvider } from './context/MatchContext';
import { ChatProvider } from './context/ChatContext';
import { Layout } from './layouts/Layout';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import ProfileView from './pages/ProfileView';
import ProfileMatches from './pages/ProfileMatches';
import SearchUsers from './pages/SearchUsers';
import Groups from './pages/Groups';
import CreateGroup from './pages/CreateGroup';
import GroupDetail from './pages/GroupDetail';
import Matches from './pages/Matches';
import Delegations from './pages/Delegations';
import Notifications from './pages/Notifications';
import AdminDashboard from './pages/AdminDashboard';
import Chats from './pages/Chats';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PostProvider>
          <FollowProvider>
            <ChatProvider>
              <MatchProvider>
                <Routes>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    <Route path="/profile" element={<Profile />} />
                    <Route path="/profile/edit" element={<EditProfile />} />
                    <Route path="/profile/:id" element={<ProfileView />} />
                    <Route path="/profile/:id/matches" element={<ProfileMatches />} />
                    <Route path="/search" element={<SearchUsers />} />

                    <Route path="/groups" element={<Groups />} />
                    <Route path="/groups/create" element={<CreateGroup />} />
                    <Route path="/groups/:id" element={<GroupDetail />} />

                    <Route path="/matches" element={<Matches />} />
                    <Route path="/delegations" element={<Delegations />} />
                    <Route path="/notifications" element={<Notifications />} />

                    <Route path="/admin" element={<AdminDashboard />} />

                    <Route path="/chats" element={<Chats />} />
                    <Route path="/chats/:chatId" element={<Chats />} />

                    {/* Add more routes here later */}
                    <Route path="*" element={<div className="p-8 text-center text-muted-foreground">404 - Page Not Found</div>} />
                  </Route>
                </Routes>
              </MatchProvider>
            </ChatProvider>
          </FollowProvider>
        </PostProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
