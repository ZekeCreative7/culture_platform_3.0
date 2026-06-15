import io
from typing import Optional
import pandas as pd

IDENTIFIER_KEYWORDS = ["이름", "name", "사번", "employee", "이메일", "email", "전화", "phone", "연락처"]

QUANT_TAGS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"]
REQUIRED_TAGS = ["기수"] + QUANT_TAGS

SCORE_MAP = {
    "매우 그렇다": 5,
    "그렇다": 4,
    "보통": 3,
    "그렇지 않다": 2,
    "전혀 그렇지 않다": 1,
    "모름": None,
    "해당없음": None,
    "모름·해당없음": None,
}


def _extract_tag(col: str) -> Optional[str]:
    col = col.strip()
    if col.startswith("[") and "]" in col:
        return col[1:col.index("]")].strip().lower()
    return None


def _to_score(value) -> Optional[int]:
    if pd.isna(value):
        return None
    s = str(value).strip()
    if s in SCORE_MAP:
        return SCORE_MAP[s]
    try:
        v = int(float(s))
        if 1 <= v <= 5:
            return v
    except (ValueError, TypeError):
        pass
    return None


def _get_text(row, tag_map: dict, tag: str) -> Optional[str]:
    if tag not in tag_map:
        return None
    val = row.get(tag_map[tag])
    if pd.isna(val):
        return None
    s = str(val).strip()
    return s if s else None


def validate_and_parse(csv_bytes: bytes, session_id: int, phase: str) -> tuple[list[dict], list[str]]:
    """
    Returns (rows, errors).
    rows: list of dicts ready for db.save_responses()
    errors: non-empty means validation failed; rows will be []
    """
    errors = []

    try:
        df = pd.read_csv(io.BytesIO(csv_bytes), encoding="utf-8-sig")
    except Exception as e:
        return [], [f"CSV 파싱 실패: {e}"]

    # 구글 폼 타임스탬프 컬럼 제거
    if df.columns[0].lower() in ["타임스탬프", "timestamp"]:
        df = df.iloc[:, 1:]

    # 식별자 컬럼 검사
    for col in df.columns:
        col_lower = col.lower()
        for kw in IDENTIFIER_KEYWORDS:
            if kw in col_lower:
                errors.append(f"직접 식별자 컬럼 발견: '{col}' — 업로드 불가")

    if errors:
        return [], errors

    # [태그] → 컬럼명 매핑
    tag_map: dict[str, str] = {}
    for col in df.columns:
        tag = _extract_tag(col)
        if tag:
            tag_map[tag] = col

    # 필수 태그 확인
    missing = [t for t in REQUIRED_TAGS if t not in tag_map]
    if missing:
        errors.append(f"필수 태그 누락: {missing}")
        return [], errors

    rows = []
    for idx, row in df.iterrows():
        try:
            cohort = int(row[tag_map["기수"]])
        except (ValueError, TypeError):
            errors.append(f"행 {idx+1}: 기수 값이 정수가 아닙니다.")
            return [], errors

        record = {
            "session_id": session_id,
            "cohort": cohort,
            "phase": phase,
            "q1": _to_score(row.get(tag_map.get("q1"))),
            "q2": _to_score(row.get(tag_map.get("q2"))),
            "q3": _to_score(row.get(tag_map.get("q3"))),
            "q4": _to_score(row.get(tag_map.get("q4"))),
            "q5": _to_score(row.get(tag_map.get("q5"))),
            "q6": _to_score(row.get(tag_map.get("q6"))),
            "q7": _to_score(row.get(tag_map.get("q7"))),
            "q8": _to_score(row.get(tag_map.get("q8"))),
            "q9":  _get_text(row, tag_map, "q9"),
            "q10": _get_text(row, tag_map, "q10"),
            "q11": _get_text(row, tag_map, "q11"),
        }
        rows.append(record)

    return rows, []
