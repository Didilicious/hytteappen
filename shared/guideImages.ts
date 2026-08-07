export type GuideImage = {
  name: string
  src: string
}

export type GuideImagesResponse = {
  imagesByGroup: Record<string, GuideImage[]>
}
