import 'dotenv/config';

export default ({ config }) => {
  return {
    ...config,
    extra: {
      backendUrl: process.env.BACKEND_URL || 'https://crackthemythapp.onrender.com',
    }
  };
};
