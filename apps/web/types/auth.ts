export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    name: string
    email: string
  }
}

export interface SignInDto {
  email: string
  password: string
}

export interface SignUpDto {
  name: string
  email: string
  password: string
}
