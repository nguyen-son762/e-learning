# sonnt — E-Learning Web App

## 하네스: E-Learning 풀스택 빌드

**목표:** 와이어프레임에서 배포까지, 디자인 → 프론트엔드(Next.js) → 백엔드(Express/Prisma) → QA → 배포(Vercel)를 에이전트 팀으로 조율한다.

**트리거:** e-learning 앱을 빌드·확장하거나(화면/API/기능 구현), 와이어프레임을 구현하거나, 풀스택 파이프라인을 실행/재실행하거나, 결과를 수정·보완·재배포하라는 요청 시 `elearning-build-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**스택 기준선:** Next.js (App Router) + Tailwind + shadcn/ui · Express + Postgres + Prisma · Vercel 배포 · 디자인 스펙은 마크다운.

**핵심 설계:** design-architect가 발행하는 `_workspace/01_design/api-contract.md`(camelCase, list 래퍼 명시)가 프론트·백엔드의 단일 진실원이며, QA는 이 계약을 기준으로 경계면을 모듈 완성 직후 점진 검증한다.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-09 | 초기 구성 (에이전트 5 + 스킬 6) | 전체 | - |
| 2026-06-09 | 프론트엔드 규칙 추가: shadcn/ui 컴포넌트가 있으면 native/커스텀 대신 우선 사용 (Button/Select/Textarea 등) | nextjs-frontend 스킬 | 스타일·토큰·a11y 일관성 |
