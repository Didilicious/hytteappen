export const noticeboardPostTypes = ['Info', 'Spørsmål', 'Må gjøres'] as const

export type NoticeboardPostType = typeof noticeboardPostTypes[number]

export type NoticeboardPost = {
  id: string
  ownerId: string
  type: NoticeboardPostType
  title: string
  description: string
  status: 'open' | 'solved'
  createdAt: string
  updatedAt: string
}
