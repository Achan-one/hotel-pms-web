import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// 요청 인터셉터: Bearer JWT 토큰 자동 주입
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('hotel_pms_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 🔒 401 연쇄 발생 시 중복 이벤트/무한 루프 방지용 플래그
let isHandlingUnauthorized = false;

// 응답 인터셉터: 안전한 세션 만료 및 스토리지 동기화 처리
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const requestUrl = error.config?.url || '';

        // 1. 로그인 요청 자체에서 난 401(비밀번호 오류)은 튕겨내지 않고 로그인 폼 에러로 전달
        const isLoginRequest = requestUrl.includes('/api/auth/login');

        if (status === 401 && !isLoginRequest) {
            if (!isHandlingUnauthorized) {
                isHandlingUnauthorized = true;

                // 세션 스토리지 및 로컬 스토리지 정리
                localStorage.removeItem('hotel_pms_token');
                localStorage.removeItem('hotel_pms_user');

                // 전역 상태 초기화 이벤트 발생
                window.dispatchEvent(new CustomEvent('auth-unauthorized', {
                    detail: { message: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' }
                }));

                // 2초 쿨다운 후 플래그 복구
                setTimeout(() => {
                    isHandlingUnauthorized = false;
                }, 2000);
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;