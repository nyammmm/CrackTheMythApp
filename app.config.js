import 'dotenv/config';

export default ({ config }) => {
  return {
    ...config,
    extra: {
      // keep any existing extra values (including eas.projectId) and add/override backendUrl
      ...(config.extra || {}),
      backendUrl: process.env.BACKEND_URL || 'https://crackthemythapp.onrender.com',
    },
  };
};
