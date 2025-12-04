import 'dotenv/config';

export default ({ config }) => {
  return {
    ...config,
    extra: {
      backendUrl: process.env.BACKEND_URL || 'http://10.0.2.2:4000',
    }
  };
};
