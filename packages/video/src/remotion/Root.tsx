import { Composition } from 'remotion'
import { PromoVideo } from './PromoVideo'

export function RemotionRoot() {
  return (
    <>
      {/* 30-second 1080p promo video at 30fps */}
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={30 * 30}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  )
}
