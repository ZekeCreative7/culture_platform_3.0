export const sampleState = {
  sessions: [
    {
      id: "session-1",
      type: "팀빌딩",
      cohort: "1",
      year: 2026,
      schedule: [
        { id: "round-1", seq: 1, confirmed: true, date: "2026-06-27", startTime: "10:00", duration: 120, content: "오프닝" },
        { id: "round-2", seq: 2, confirmed: true, date: "2026-07-05", startTime: "10:00", duration: 120, content: "중간 워크숍" },
        { id: "round-5", seq: 3, confirmed: false, date: "", startTime: "", duration: 120, content: "마무리" }
      ]
    },
    {
      id: "session-2",
      type: "리더십",
      cohort: "2",
      year: 2026,
      schedule: [
        { id: "round-3", seq: 1, confirmed: true, date: "2026-06-20", startTime: "14:00", duration: 90, content: "사전조사 및 진단" },
        { id: "round-4", seq: 2, confirmed: true, date: "2026-06-24", startTime: "14:00", duration: 90, content: "행동 약속 실천" }
      ]
    }
  ],
  responses: [
    // session-1 has "사전" response, but no "사후" response
    { id: "resp-1", sessionId: "session-1", phase: "사전", q1: 5, q2: 4 },
    { id: "resp-2", sessionId: "session-1", phase: "사전", q1: 4, q2: 4 },
    // session-2 has both "사전" and "사후" responses (report_ready)
    { id: "resp-3", sessionId: "session-2", phase: "사전", q1: 3, q2: 3 },
    { id: "resp-4", sessionId: "session-2", phase: "사후", q1: 5, q2: 5 }
  ],
  pulseCommitments: [
    {
      id: "commit-1",
      status: "in_progress",
      dueDate: "2026-06-01",
      commitment: "매주 1회 팀원과 1on1 미팅하기",
      ownerRole: "팀장"
    },
    {
      id: "commit-2",
      status: "in_progress",
      dueDate: "2026-06-30",
      commitment: "팀 회의에서 경청하기",
      ownerRole: "본부장"
    },
    {
      id: "commit-3",
      status: "done",
      dueDate: "2026-05-15",
      commitment: "완료된 약속"
    }
  ]
};
