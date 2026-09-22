import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// 요청 인터셉터: Bearer JWT 토큰 자동 주입
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('hotel_pms_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 응답 인터셉터: 401 Unauthorized 처리
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('hotel_pms_token');
            localStorage.removeItem('hotel_pms_user');
            window.dispatchEvent(new Event('auth-unauthorized'));
        }
        return Promise.reject(error);
    }
);

export default apiClient;