import { api } from "../api/client";

export interface SendPhoneOtpResult {
  alreadyVerified: boolean;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
  sendsRemaining?: number;
}

export const PhoneService = {
  sendOtp: async (phone: string): Promise<SendPhoneOtpResult> => {
    const res = await api.post("/phone/otp/send", { phone });
    return res.data.data;
  },

  verifyOtp: async (phone: string, code: string): Promise<{ phone: string; verifiedAt: string }> => {
    const res = await api.post("/phone/otp/verify", { phone, code });
    return res.data.data;
  },

  listVerified: async (): Promise<string[]> => {
    const res = await api.get("/phone/verified");
    return res.data.data.phones;
  },
};
