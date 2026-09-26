import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// 요청 인터셉터: 탭별 독립 세션 스토리지에서 Bearer JWT 토큰 주입
apiClient.interceptors.request.use(
    (config) => {
        // 🚀 localStorage -> sessionStorage로 변경하여 탭 간 토큰 격리
        const token = sessionStorage.getItem('hotel_pms_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

let isHandlingUnauthorized = false;

// 응답 인터셉터: 세션 만료 처리
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const requestUrl = error.config?.url || '';

        const isLoginRequest = requestUrl.includes('/api/auth/login');

        if (status === 401 && !isLoginRequest) {
            if (!isHandlingUnauthorized) {
                isHandlingUnauthorized = true;

                // 🚀 sessionStorage 정리
                sessionStorage.removeItem('hotel_pms_token');
                sessionStorage.removeItem('hotel_pms_user');

                window.dispatchEvent(new CustomEvent('auth-unauthorized', {
                    detail: { message: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' }
                }));

                setTimeout(() => {
                    isHandlingUnauthorized = false;
                }, 2000);
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;