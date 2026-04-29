class KovaTTSError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None, body: object = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class KovaTTSAuthError(KovaTTSError):
    pass


class KovaTTSRateLimitError(KovaTTSError):
    pass


class KovaTTSServerError(KovaTTSError):
    pass


class KovaTTSValidationError(KovaTTSError):
    pass


class KovaTTSConnectionError(KovaTTSError):
    pass


class KovaTTSProtocolError(KovaTTSError):
    pass


def error_for_status(status_code: int, body: object = None) -> KovaTTSError:
    message = f"Kova TTS request failed with {status_code}"
    if status_code in (401, 403):
        return KovaTTSAuthError(message, status_code=status_code, body=body)
    if status_code == 429:
        return KovaTTSRateLimitError(message, status_code=status_code, body=body)
    if status_code in (400, 422):
        return KovaTTSValidationError(message, status_code=status_code, body=body)
    if status_code >= 500:
        return KovaTTSServerError(message, status_code=status_code, body=body)
    return KovaTTSError(message, status_code=status_code, body=body)
