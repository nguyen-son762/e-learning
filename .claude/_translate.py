import os, glob

# Korean -> English literal replacements. Applied longest-key-first so that
# longer headers are replaced before their shorter substrings.
M = {
    # --- section headers (##) ---
    "## 핵심 역할": "## Core Role",
    "## 작업 원칙 (왜 incremental인가)": "## Working Principles (why incremental)",
    "## 작업 원칙": "## Working Principles",
    "## 입력/출력 프로토콜": "## Input/Output Protocol",
    "## 팀 통신 프로토콜 (에이전트 팀 모드)": "## Team Communication Protocol (agent team mode)",
    "## 에러 핸들링": "## Error Handling",
    "## 협업": "## Collaboration",
    "## 이전 산출물이 있을 때": "## When Previous Output Exists",
    "## API 계약 형식 (api-contract.md)": "## API Contract Format (api-contract.md)",
    '## 검증 방법: "양쪽 동시 읽기" (read both sides together)': '## Verification Method: "read both sides together"',
    "## 검증 우선순위": "## Verification Priority",
    "## 계약이 불가능하면": "## If the Contract Is Infeasible",
    "## 계약이 틀렸다고 생각되면": "## If You Think the Contract Is Wrong",
    "## 데이터 훅 — 계약에 타입을 맞춰라": "## Data Hooks — Match Types to the Contract",
    "## 데이터 흐름": "## Data Flow",
    "## 라우팅 — 링크는 실제 라우트를 가리켜야 한다": "## Routing — Links Must Point at Real Routes",
    "## 목차": "## Table of Contents",
    "## 보고 형식": "## Report Format",
    "## 보고": "## Reporting",
    "## 비동기 작업": "## Async Work",
    "## 산출물": "## Artifacts",
    "## 상태 머신 완전성": "## State Machine Completeness",
    "## 상태 처리": "## State Handling",
    "## 수정 시": "## On Revision",
    "## 실행 모드: 에이전트 팀": "## Execution Mode: Agent Team",
    "## 에이전트 구성": "## Agent Composition",
    "## 완료 후": "## After Completion",
    "## 왜 계약이 먼저인가": "## Why the Contract Comes First",
    "## 왜 빌드 통과로는 부족한가": "## Why a Passing Build Is Not Enough",
    "## 워크플로우": "## Workflow",
    "## 응답은 계약과 정확히 일치해야 한다": "## Responses Must Match the Contract Exactly",
    "## 인증 & 검증": "## Auth & Validation",
    "## 일반화 / 가정": "## Generalization / Assumptions",
    "## 자격 증명이 없을 때": "## When Credentials Are Unavailable",
    "## 작업 순서": "## Work Order",
    "## 절차": "## Procedure",
    "## 점진적 실행": "## Incremental Execution",
    "## 진입 조건": "## Entry Condition",
    "## 출력": "## Output",
    "## 테스트 시나리오": "## Test Scenarios",
    "## 통합 정합성 체크리스트 (핵심)": "## Integration Coherence Checklist (core)",
    "## 팀 크기": "## Team Size",
    "## 프로젝트 구조": "## Project Structure",
    "## 핵심 원칙: 양쪽을 동시에 읽어라": "## Core Principle: Read Both Sides Together",
    "## Prisma 스키마": "## Prisma Schema",
    "## 1. API 응답 shape ↔ 프론트 훅 타입": "## 1. API Response Shape ↔ Frontend Hook Type",
    "## 1. 빌드 검증": "## 1. Build Verification",
    "## 2. 라우팅 정합성": "## 2. Routing Coherence",
    "## 2. 환경 변수 (계약처럼 다뤄라)": "## 2. Environment Variables (treat them like a contract)",
    "## 3. Vercel 설정": "## 3. Vercel Configuration",
    "## 3. 상태 머신 정합성": "## 3. State Machine Coherence",
    "## 4. 엔드포인트 ↔ 훅 1:1 매핑": "## 4. Endpoint ↔ Hook 1:1 Mapping",
    "## 5. DB 마이그레이션": "## 5. DB Migration",
    "## 5. 데이터 흐름 (casing / null)": "## 5. Data Flow (casing / null)",
    "## 6. 빌드 & 타입 신호": "## 6. Build & Type Signals",
    # --- phase headers (###) ---
    "### Phase 0: 컨텍스트 확인 (후속 작업 지원)": "### Phase 0: Context Check (follow-up support)",
    "### Phase 1: 준비": "### Phase 1: Preparation",
    "### Phase 2: 팀 구성": "### Phase 2: Team Setup",
    "### Phase 3: 빌드 (자체 조율)": "### Phase 3: Build (self-coordinated)",
    "### Phase 4: 통합 QA & 게이트": "### Phase 4: Integration QA & Gate",
    "### Phase 5: 배포": "### Phase 5: Deployment",
    "### Phase 6: 정리 & 진화": "### Phase 6: Cleanup & Evolution",
    "### 에러 흐름": "### Error Flow",
    "### 정상 흐름": "### Normal Flow",
    # --- ToC numbered entries (qa-checklist) ---
    "1. API 응답 shape ↔ 프론트 훅 타입": "1. API Response Shape ↔ Frontend Hook Type",
    "2. 라우팅 정합성": "2. Routing Coherence",
    "3. 상태 머신 정합성": "3. State Machine Coherence",
    "4. 엔드포인트 ↔ 훅 1:1 매핑": "4. Endpoint ↔ Hook 1:1 Mapping",
    "5. 데이터 흐름 (casing / null)": "5. Data Flow (casing / null)",
    "6. 빌드 & 타입 신호": "6. Build & Type Signals",
    # --- protocol / io labels ---
    "- 메시지 수신:": "- Receives:",
    "- 메시지 발신:": "- Sends:",
    "- 작업 요청:": "- Task claiming:",
    "- 입력:": "- Input:",
    "- 출력 (write all to": "- Output (write all to",
    "- 출력:": "- Output:",
    "**산출물 저장:**": "**Artifact storage:**",
    "**실행 방식:** 팀원들이 자체 조율.": "**Execution:** teammates self-coordinate.",
    # --- orchestrator agent composition + error tables ---
    "| 팀원 | 에이전트 타입 | 역할 | 스킬 | 출력 |": "| Teammate | Agent Type | Role | Skill | Output |",
    "| 상황 | 전략 |": "| Situation | Strategy |",
    "| 팀원 1명 실패/중지 |": "| One teammate fails/stops |",
    "| 팀원 과반 실패 |": "| Majority of teammates fail |",
    "| 타임아웃 |": "| Timeout |",
    "| 계약 분쟁 (front vs back) |": "| Contract dispute (front vs back) |",
    "| QA FAIL 미해결 (2라운드 후) |": "| Unresolved QA FAIL (after 2 rounds) |",
    "| 빌드 실패 at deploy |": "| Build failure at deploy |",
    "| 데이터 충돌 |": "| Data conflict |",
    # --- QA boundary tables ---
    "| 검증 대상 | 왼쪽 (생산자) | 오른쪽 (소비자) |": "| Target | Left (producer) | Right (consumer) |",
    "| 경계면 | 생산자 (왼쪽) | 소비자 (오른쪽) | 흔한 버그 |": "| Boundary | Producer (left) | Consumer (right) | Common bug |",
    "| 응답 shape |": "| Response shape |",
    "| 필드 casing |": "| Field casing |",
    "| 라우팅 |": "| Routing |",
    "| 상태 전이 |": "| State transition |",
    "| 엔드포인트 커버리지 |": "| Endpoint coverage |",
    "| 동기/비동기 |": "| Sync/async |",
    # --- inline ---
    "변경 이력": "change log",
}

files = glob.glob(".claude/agents/*.md") + glob.glob(".claude/skills/**/*.md", recursive=True)
for path in files:
    with open(path, encoding="utf-8") as f:
        text = f.read()
    for k in sorted(M, key=len, reverse=True):
        text = text.replace(k, M[k])
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
print(f"processed {len(files)} files")
