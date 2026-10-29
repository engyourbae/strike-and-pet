import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { OnlineBanner, UpdateBanner } from '@/components/StatusBanners';
import { LoginPage } from '@/features/auth/LoginPage';
import { OnboardingPage, hasOnboarded } from '@/features/auth/OnboardingPage';
import { SplashPage } from '@/features/auth/SplashPage';
import { UsernamePage } from '@/features/auth/UsernamePage';
import { FriendsPage } from '@/features/friends/FriendsPage';
import { GroupDetailPage } from '@/features/groups/GroupDetailPage';
import { GroupsPage } from '@/features/groups/GroupsPage';
import { ChatListPage } from '@/features/chat/ChatListPage';
import { ChatProvider } from '@/features/chat/ChatProvider';
import { ChatRoomPage } from '@/features/chat/ChatRoomPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider';
import { MorePage } from '@/features/settings/MorePage';
import { PrivacySettingsPage } from '@/features/settings/PrivacySettingsPage';
import { MediaQueueProvider } from '@/features/media/MediaQueueProvider';
import { LocalMediaPage } from '@/features/media/LocalMediaPage';
import { MediaViewerPage } from '@/features/media/MediaViewerPage';
import { StorageSettingsPage } from '@/features/media/StorageSettingsPage';
import { StoryFeedPage } from '@/features/media/StoryFeedPage';
import { StoryViewerPage } from '@/features/media/StoryViewerPage';
import { LocationPage } from '@/features/location/LocationPage';
import { LocationSessionPage } from '@/features/location/LocationSessionPage';
import { LocationSettingsPage } from '@/features/location/LocationSettingsPage';
import { LocationShareProvider } from '@/features/location/LocationShareProvider';
import { PublicPage } from '@/components/PublicPage';
import { OfflinePage } from '@/components/OfflineFallback';
import { HelpPage } from '@/features/legal/HelpPage';
import { PrivacyPolicyPage } from '@/features/legal/PrivacyPolicyPage';
import { TermsPage } from '@/features/legal/TermsPage';
import { AccountSettingsPage } from '@/features/settings/AccountSettingsPage';
import { SettingsProvider } from './SettingsProvider';
import { InboxProvider } from '@/features/social/InboxProvider';
import { PetPage } from '@/features/pet/PetPage';
import { StrikePage } from '@/features/streak/StrikePage';
import { HomePage } from '@/features/profile/HomePage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { ThemeSettingsPage } from '@/features/settings/ThemeSettingsPage';
import { useAuth } from './AuthProvider';
import { ConfigMissingPage, ErrorPage, NotFoundPage } from './StatusPages';

function AppRoutes() {
  const auth = useAuth();
  switch (auth.status) {
    case 'loading':
      return <SplashPage />;
    case 'unconfigured':
      return <ConfigMissingPage />;
    case 'error':
      return <ErrorPage message={auth.message} />;
    case 'signedOut':
      return (
        <Routes>
          <Route path="/selamat-datang" element={<OnboardingPage />} />
          <Route path="/masuk" element={<LoginPage />} />
          <Route path="/bantuan" element={<PublicPage><HelpPage /></PublicPage>} />
          <Route path="/kebijakan-privasi" element={<PublicPage><PrivacyPolicyPage /></PublicPage>} />
          <Route path="/syarat" element={<PublicPage><TermsPage /></PublicPage>} />
          <Route path="*" element={<Navigate to={hasOnboarded() ? '/masuk' : '/selamat-datang'} replace />} />
        </Routes>
      );
    case 'needsUsername':
      return <UsernamePage user={auth.user} />;
    case 'ready':
      return (
        <SettingsProvider uid={auth.user.uid}>
        <InboxProvider uid={auth.user.uid}>
        <ChatProvider uid={auth.user.uid}>
        <NotificationsProvider uid={auth.user.uid}>
        <MediaQueueProvider me={auth.profile}>
        <LocationShareProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage profile={auth.profile} />} />
            <Route path="chat" element={<ChatListPage me={auth.profile} />} />
            <Route path="chat/:cid" element={<ChatRoomPage me={auth.profile} />} />
            <Route path="bantuan" element={<HelpPage />} />
            <Route path="kebijakan-privasi" element={<PrivacyPolicyPage />} />
            <Route path="syarat" element={<TermsPage />} />
            <Route path="offline" element={<OfflinePage />} />
            <Route path="pengaturan/akun" element={<AccountSettingsPage me={auth.profile} />} />
            <Route path="lokasi" element={<LocationPage me={auth.profile} />} />
            <Route path="lokasi/:sid" element={<LocationSessionPage me={auth.profile} />} />
            <Route path="pengaturan/lokasi" element={<LocationSettingsPage me={auth.profile} />} />
            <Route path="story" element={<StoryFeedPage me={auth.profile} />} />
            <Route path="story/:ownerUid" element={<StoryViewerPage me={auth.profile} />} />
            <Route path="media/:id" element={<MediaViewerPage me={auth.profile} />} />
            <Route path="media-lokal" element={<LocalMediaPage me={auth.profile} />} />
            <Route path="pengaturan/penyimpanan" element={<StorageSettingsPage me={auth.profile} />} />
            <Route path="notifikasi" element={<NotificationsPage />} />
            <Route path="lainnya" element={<MorePage />} />
            <Route path="pengaturan/privasi" element={<PrivacySettingsPage />} />
            <Route path="pet" element={<PetPage me={auth.profile} />} />
            <Route path="strike" element={<StrikePage me={auth.profile} />} />
            <Route path="teman" element={<FriendsPage me={auth.profile} />} />
            <Route path="grup" element={<GroupsPage me={auth.profile} />} />
            <Route path="grup/:id" element={<GroupDetailPage me={auth.profile} />} />
            <Route path="profil" element={<ProfilePage profile={auth.profile} />} />
            <Route path="pengaturan/tema" element={<ThemeSettingsPage />} />
            <Route path="masuk" element={<Navigate to="/" replace />} />
            <Route path="selamat-datang" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </LocationShareProvider>
        </MediaQueueProvider>
        </NotificationsProvider>
        </ChatProvider>
        </InboxProvider>
        </SettingsProvider>
      );
  }
}

export function App() {
  return (
    // HashRouter: aman untuk GitHub Pages (refresh/tautan langsung tidak 404).
    <HashRouter>
      <OnlineBanner />
      <UpdateBanner />
      <AppRoutes />
    </HashRouter>
  );
}
