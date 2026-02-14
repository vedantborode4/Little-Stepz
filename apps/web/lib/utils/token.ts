import Cookies from "js-cookie"

export const getToken = () => Cookies.get("accessToken")
export const setToken = (token: string) =>
  Cookies.set("accessToken", token)
export const removeToken = () => Cookies.remove("accessToken")
