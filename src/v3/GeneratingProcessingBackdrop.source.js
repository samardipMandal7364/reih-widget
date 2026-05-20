import React from "react";
import DivUI from "@/ui-components/atoms/Div";
import { DashedLoaderUI } from "@/ui-components/atoms/DashedLoader";
import { getThumbnail } from "@/utils/helperFunctions";
import { styles } from "./generatingProcessingBackdropStyles";
import ImageUI from "@/ui-components/atoms/Image";
import { BackdropLottieLoader } from "./BackdropLottieLoader";

export const GeneratingProcessingBackdrop = ({
  imageUrl,
  loaderSx,
  rootSx,
  backdropSx,
  imageStyle,
  isGifLoader = false,
  title = "Generating...",
  titleSx = {},
  radialBackdropOnly = false,
  backdropLottieProps,
}) => {
  const originalImageSrc =
    imageUrl &&
    (imageUrl.startsWith("blob:") || imageUrl.startsWith("data:")
      ? imageUrl
      : getThumbnail(imageUrl));

  const loader = isGifLoader ? (
    <BackdropLottieLoader {...backdropLottieProps} />
  ) : (
    <DashedLoaderUI sx={{ ...styles.processingLoader, ...loaderSx }} />
  );

  const hasTitle =
    title != null &&
    (typeof title !== "string" || title.trim().length > 0);

  const titleNode = hasTitle ? (
    <DivUI
      sx={{
        ...(originalImageSrc
          ? styles.processingTitleOverlay
          : styles.processingTitleStandalone),
        ...titleSx,
      }}
    >
      {title}
    </DivUI>
  ) : null;

  const loaderBlock = hasTitle ? (
    <DivUI sx={styles.processingLoaderStack}>
      <DivUI sx={styles.processingLoaderWrapper}>{loader}</DivUI>
      {titleNode}
    </DivUI>
  ) : (
    <DivUI sx={styles.processingLoaderWrapper}>{loader}</DivUI>
  );

  if (!originalImageSrc) {
    return (
      <DivUI sx={{ ...styles.processingCardContainer, ...rootSx }}>
        {loaderBlock}
      </DivUI>
    );
  }

  return (
    <DivUI sx={{ ...styles.processingCardWithImageRoot, ...rootSx }}>
      <ImageUI
        fill
        src={originalImageSrc}
        alt="generating processing backdrop"
        style={{ ...styles.processingCardImage, ...imageStyle }}
      />
      <DivUI
        sx={{
          ...styles.processingBackdrop(radialBackdropOnly),
          ...backdropSx,
        }}
        aria-hidden
      />
      <DivUI sx={styles.processingLoaderLayer}>{loaderBlock}</DivUI>
    </DivUI>
  );
};
