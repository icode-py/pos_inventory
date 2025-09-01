// utils/fetchUser.js
import axiosInstance from './axiosInstance';

export const fetchUser = async () => {
  try {
    const res = await axiosInstance.get('/me/'); // or /profile/
    return res.data;
  } catch {
    return null;
  }
};
