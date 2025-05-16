import { UserScope } from "@logto/express";

const configLogto = {
  scopes: [UserScope.Email, UserScope.Phone, UserScope.Roles],
  endpoint: "https://logto.jainparichay.online",
  appId: "b52m65vn0caise4jfv1da",
  appSecret: "LXuBf4bQ08fx0uEHqBv2heyKJPwdXSbZ",
  baseUrl: "https://backend.impressment.in",
};

export default configLogto;
