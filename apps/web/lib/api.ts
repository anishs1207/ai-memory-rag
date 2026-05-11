import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('image', file);
  const response = await api.post('/images/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getAllImages = async () => {
  const response = await api.get('/images');
  return response.data;
};

export const getImageMetadata = async (id: string) => {
  const response = await api.get(`/images/${id}`);
  return response.data;
};

export const getImageUrl = (id: string) => {
  return `${API_BASE_URL}/images/${id}/file`;
};

export const getStats = async () => {
  const response = await api.get('/images/stats');
  return response.data;
};

export const queryMemory = async (query: string) => {
  const response = await api.post('/backend/query', { query });
  return response.data;
};

export const getAllPeople = async () => {
  const response = await api.get('/images/people/all');
  return response.data;
};

export const getAllRelationships = async () => {
  const response = await api.get('/images/relationships/all');
  return response.data;
};

export const getAllEvents = async () => {
  const response = await api.get('/images/events/all');
  return response.data;
};

export const resetAllData = async () => {
  const response = await api.post('/images/reset-all');
  return response.data;
};

export const renamePerson = async (personId: string, name: string) => {
  const response = await api.post(`/images/people/${personId}/rename`, { name });
  return response.data;
};

export const searchImages = async (query: string) => {
  const response = await api.get(`/images/search?q=${encodeURIComponent(query)}`);
  return response.data;
};

export const searchByText = async (query: string) => {
  const response = await api.get(`/images/search-by-text?q=${encodeURIComponent(query)}`);
  return response.data;
};

export const mergePeople = async (targetId: string, sourceId: string) => {
  const response = await api.post('/images/people/merge', { targetId, sourceId });
  return response.data;
};

export const getGeographicImages = async () => {
  const response = await api.get('/images/geo/all');
  return response.data;
};

export const getJournals = async () => {
  const response = await api.get('/images/journals/all');
  return response.data;
};

export const generateJournal = async (date: string) => {
  const response = await api.post('/images/journals/generate', { date });
  return response.data;
};

export const searchByImage = async (file: File) => {
  const formData = new FormData();
  formData.append('image', file);
  const response = await api.post('/images/search-by-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const getPredictions = async () => {
  const response = await api.get('/images/predictions');
  return response.data;
};

export const getFlashbacks = async () => {
  const response = await api.get('/images/flashbacks');
  return response.data;
};

export const getPersonHighlight = async (personId: string) => {
  const response = await api.get(`/images/people/${personId}/highlight`);
  return response.data;
};

export const chatWithMemory = async (query: string, history: any[]) => {
  const response = await api.post('/backend/chat', { query, history });
  return response.data;
};

export default api;
