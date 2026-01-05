// types.ts - Complete updated file

// ============ BASE MODELS ============

export interface ApplicationUser {
  id: string;
  userName?: string;
  email?: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  description: string;
  followersCount: number;
  followingCount: number;
  isProfilePublic: boolean;
  createdAt: Date;

  posts?: Post[];
  likeCount?: number;
  comments?: Comment[];
  matchAssignments?: MatchAssignment[];
  chatUsers?: ChatUser[];
  messages?: Message[];
  following?: Follow[];
  followers?: Follow[];
  followingRequest?: FollowRequest[];
  followerRequest?: FollowRequest[];
}

export interface Championship {
  championshipId: string;
  name: string;
  location: string;
  startDate: Date;
  endDate: Date;
  matches?: Match[];
}

export interface Match {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  location: string;
  championshipId: string;
  championship?: Championship;
  matchAssignments?: MatchAssignment[];
  groupChat?: Chat;
}

export interface MatchAssignment {
  matchAssignmentId: string;
  matchId: string;
  userId: string;
  role: string;
  assignedAt: Date;
  match?: Match;
  user?: ApplicationUser;
}

export interface Chat {
  chatId: string;
  description: string;
  isGroupChat: boolean;
  createdAt: Date;
  createdByUserId: string;
  matchId?: string;
  match?: Match;
  chatUsers?: ChatUser[];
  messages?: Message[];
}

export interface ChatUser {
  chatId: string;
  userId: string;
  joinedAt: Date;
  chat?: Chat;
  user?: ApplicationUser;
}

export interface Message {
  messageId: string;
  chatId: string;
  senderId: string;
  content: string;
  sentAt: Date;
  chat?: Chat;
  sender?: ApplicationUser;
}

export interface Post {
  postId: string;
  likeCount: number;
  userId: string;
  mediaType: string;
  mediaUrl: string;
  description: string;
  createdAt: Date;
  user?: ApplicationUser;
  comments?: Comment[];
  likes?: Like[];
}

export interface Comment {
  commentId: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  parentCommentId?: string;
  post?: Post;
  user?: ApplicationUser;
  parentComment?: Comment;
  replies?: Comment[];
}

export interface Follow {
  followerId: string;
  followingId: string;
  followedAt: Date;
  follower?: ApplicationUser;
  following?: ApplicationUser;
}

export interface FollowRequest {
  followerId: string;
  followingId: string;
  requestedAt: Date;
  followerRequest?: ApplicationUser;
  followingRequest?: ApplicationUser;
}

export interface Like {
  userId: string;
  postId: string;
  likedAt: Date;
  user?: ApplicationUser;
  post?: Post;
}

// ============ DTOs ============

export interface LikeDto {
  userId: string;
  postId: string;
  likedAt: Date;
}

export interface FollowDto {
  followerId: string;
  followingId: string;
  followedAt: Date;
}

export interface FollowRequestDto {
  followRequestId: string;
  followerId: string;
  followingId: string;
  requestedAt: Date;
}

// Championship DTOs
export interface ChampionshipDto {
  championshipId: string;
  name: string;
  location: string;
  startDate: Date;
  endDate: Date;
}

export interface CreateChampionshipDto {
  name: string;
  location: string;
  startDate: Date;
  endDate: Date;
}

export interface UpdateChampionshipDto {
  name: string;
  location: string;
  startDate: Date;
  endDate: Date;
}

// Comment DTOs
export interface CommentDto {
  commentId: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  parentCommentId?: string;
}

export interface CreateCommentDto {
  postId: string;
  content: string;
  userId: string;
  parentCommentId?: string;
}

export interface UpdateCommentDto {
  content: string;
}

// Match DTOs
export interface MatchDto {
  matchId: string;
  // homeTeam and awayTeam are not in backend 'Matches' table directly, 
  // but parsed from the 'Score' field or retrieved elsewhere if logic changes.
  // For now we make them optional or removed if we rely on score parsing.
  // We keep them optional to avoid breaking existing UI types until we refactor fully.
  homeTeam?: string;
  awayTeam?: string;

  matchDate: Date;
  location: string;
  championshipId: string;
  score: string; // Contains "Home 1 - 1 Away" or similar
  status: string;
}

export interface CreateMatchDto {
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  location: string;
  championshipId: string;
  score?: string;
  status?: string;
}

export interface UpdateMatchDto {
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  location: string;
  championshipId: string;
  score?: string;
  status?: string;
}

// Match Assignment DTOs
export interface MatchAssignmentDto {
  matchAssignmentId: string;
  matchId: string;
  userId: string;
  role: string;
  assignedAt: Date;
  user?: UserDto;
}

export interface CreateMatchAssignmentDto {
  matchId: string;
  userId: string;
  RoleInMatch: string;
}

export interface UpdateMatchAssignmentDto {
  role: string;
}

// Post DTOs
export interface PostDto {
  postId: string;
  likeCount: number;
  userId: string;
  mediaType: string;
  mediaUrl: string;
  description: string;
  createdAt: Date;
  comments?: CommentDto[];
}

export interface CreatePostDto {
  mediaType: string;
  mediaUrl: string;
  description: string;
  userId: string;
}

export interface UpdatePostDto {
  description: string;
  mediaUrl: string;
  mediaType: string;
}

// User DTOs
export interface UserDto {
  id: string;
  userName?: string;
  email?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  description: string;
  profileImageUrl: string;
  isProfilePublic: boolean;
  createdAt: Date;
  followersCount: number;
  followingCount: number;
}

export interface CreateUserDto {
  userName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  description?: string;
  profileImageUrl?: string;
}

export interface UpdateUserDto {
  userName: string;
  firstName: string;
  lastName: string;
  description: string;
  profileImageUrl: string;
  isProfilePublic: boolean;
}

export interface ProfileDto {
  id: string;
  userName?: string;
  fullName: string;
  description: string;
  followersCount: number;
  followingCount: number;
  profileImageUrl: string;
  isProfilePublic: boolean;
}

export interface ProfileExtendedDto extends ProfileDto {
  Posts?: PostDto[];
}

export interface LoginDto {
  userName: string;
  password: string;
}

// ============ CHAT DTOs (UPDATED) ============

// Matches RefConnect/DTOs/Chats/ChatDto.cs
// IMPORTANT:
// Backend DTO uses PascalCase (ChatId, ChatType, ...). Depending on your JSON serializer
// configuration, the API may return either camelCase or PascalCase.
//
// We keep the existing camelCase ChatDto (used throughout the UI) and also export a
// PascalCase variant for strict alignment/testing.
export interface ChatDto {
  chatId: string;
  chatType: string;              // e.g. "Group" | "Direct"
  createdAt: string;             // ISO date string
  name: string;
  description: string;
  createdByUserId: string;
  chatUsers: ChatUserDto[];
  messages: MessageDto[] | null;
}

// Exact shape provided by backend (RefConnect.DTOs.Chats.ChatDto)
export interface ChatDtoPascalCase {
  ChatId: string;
  ChatType: string;
  CreatedAt: string;
  Name: string;
  Description: string;
  CreatedByUserId: string;
  ChatUsers: ChatUserDtoPascalCase[];
  Messages: MessageDtoPascalCase[] | null;
}

// Matches RefConnect/DTOs/Chats/ChatDto.cs -> ChatUserDto

// What /Chats currently returns (minimal membership rows)
export interface ChatUserDto {
  chatUserId: string;
  chatId: string;
  userId: string;
}

// Exact shape provided by backend for chat users
export interface ChatUserDtoPascalCase {
  ChatUserId: string;
  ChatId: string;
  UserId: string;
}


export interface CreateGroupChatDto {
  // Backend expects GroupName (see validation error), but we keep `name` for UI
  // and map it in the API call.
  name: string;
  description?: string;
  initialUserIds: string[];
}


export interface UpdateChatDto {
  name?: string;
  description?: string;
}

// ============ MESSAGE DTOs (UPDATED) ============

// Matches RefConnect/DTOs/Messages/MessageDto.cs
export interface MessageDto {
  messageId: string;
  chatId: string;
  userId: string;
  content: string;
  sentAt: string;
}

// Exact shape provided by backend for messages
export interface MessageDtoPascalCase {
  MessageId: string;
  ChatId: string;
  UserId: string;
  Content: string;
  SentAt: string;
}

// Matches RefConnect/DTOs/Messages/CreateMessageDto.cs
export interface CreateMessageDto {
  chatId: string;
  content: string;
  userId: string;
}

// Matches RefConnect/DTOs/Messages/UpdateMessageDto.cs
export interface UpdateMessageDto {
  content: string;
}

// ============ CHAT JOIN REQUEST DTOs ============

export type ChatJoinRequestStatus = "Pending" | "Accepted" | "Declined";

// Matches RefConnect/DTOs/ChatJoinRequest/ChatJoinRequestDto.cs
export interface ChatJoinRequestDto {
  chatJoinRequestId: string;
  chatId: string;
  chatName: string;
  userId: string;
  userName: string;
  userProfilePicture: string | null;
  status: ChatJoinRequestStatus;
  requestedAt: string; // ISO date string
}

// Matches RefConnect/DTOs/ChatJoinRequest/CreateChatJoinRequestDto.cs
export interface CreateChatJoinRequestDto {
  chatId: string;
}

export interface ChatJoinRequestResponse {
  message: string;
}

// ============ UTILITY TYPES ============

export interface PagedResult<T> {
  page: number;
  pageSize: number;
  totalCount: number;
  items: T[];
}

// ============ API SERVICE INTERFACES ============

export interface ChatJoinRequestApi {
  getRequestsForOwner: () => Promise<ChatJoinRequestDto[]>;
  getRequestsForChat: (chatId: string) => Promise<ChatJoinRequestDto[]>;
  getMyPendingRequests: () => Promise<ChatJoinRequestDto[]>;
  createJoinRequest: (dto: CreateChatJoinRequestDto) => Promise<ChatJoinRequestDto>;
  acceptRequest: (requestId: string) => Promise<ChatJoinRequestResponse>;
  declineRequest: (requestId: string) => Promise<ChatJoinRequestResponse>;
  cancelRequest: (requestId: string) => Promise<void>;
}