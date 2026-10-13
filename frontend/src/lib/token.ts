// In-memory token store — access token never touches localStorage
let _accessToken: string | null = null;

export const tokenStore = {
  get: () => _accessToken,
  set: (t: string | null) => {
    _accessToken = t;
  },
};
