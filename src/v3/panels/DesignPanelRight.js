/**
 * Ported from MediaChatModal/DesignPanelRight/index.js
 * Includes: keyboard nav, auto-scroll thumbs, image preload, generation sync.
 */
import { h } from 'preact';
import { useState, useEffect, useRef, useMemo, useCallback } from 'preact/hooks';
import { CompareSlider } from '../../components/CompareSlider';
import { GeneratingProcessingBackdrop } from '../GeneratingProcessingBackdrop';
import { FloatingButtons } from './FloatingButtons';
import { GenerationUI } from './GenerationUI';
import {
  getLastGeneratedPreviewDisplayUrl,
  getActiveThinkingLabelAtDisplayPos,
} from '../utils';

export function DesignPanelRight({
  mediaDetail,
  isLastMessageGenerating,
  thoughtsText,
  mediaId,
  onSelectGenerationId,
}) {
  const [mediaUrl, setMediaUrl] = useState(mediaDetail?.imgSrc || mediaDetail?.url || '');
  const [selectedGenOutputId, setSelectedGenOutputId] = useState(
    mediaDetail?.selectedGenerationId ?? null
  );
  const [selectedGenId, setSelectedGenId] = useState(null);
  const [showCompareImages, setShowCompareImages] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [thoughtStreamSyncTick, setThoughtStreamSyncTick] = useState(0);
  const scrollRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (mediaDetail?.imgSrc || mediaDetail?.url) {
      setMediaUrl(mediaDetail?.imgSrc || mediaDetail?.url);
    }
  }, [mediaDetail?.imgSrc, mediaDetail?.url]);

  useEffect(() => {
    const id = mediaDetail?.selectedGenerationId;
    if (id !== undefined) setSelectedGenOutputId(id);
  }, [mediaDetail?.selectedGenerationId]);

  const handleEmptyGenerationOutputId = useCallback((generationOutputId = null) => {
    onSelectGenerationId?.(generationOutputId);
    setMediaUrl(mediaDetail?.imgSrc || mediaDetail?.url || '');
    setShowCompareImages(false);
    setSelectedGenId(generationOutputId);
  }, [onSelectGenerationId, mediaDetail?.imgSrc, mediaDetail?.url]);

  const handleSelectGeneration = useCallback((generation_output_id) => {
    if (!generation_output_id) {
      handleEmptyGenerationOutputId(null);
      return;
    }
    if (generation_output_id === 'generating') {
      handleEmptyGenerationOutputId('generating');
      return;
    }

    mediaDetail?.generations?.forEach((generation) => {
      generation?.generation_output_ids?.forEach((output) => {
        if (output._id === generation_output_id) {
          setMediaUrl(output.preview_url);
          setSelectedGenId(generation._id);
        }
      });
    });

    onSelectGenerationId?.(generation_output_id);
  }, [mediaDetail?.generations, onSelectGenerationId, handleEmptyGenerationOutputId]);

  const scrollToGeneration = useCallback((generation_output_id) => {
    if (!scrollRef.current || !generation_output_id) return;
    try {
      const scrollContainer = scrollRef.current;
      if (!scrollContainer.offsetWidth) return;
      const elements = scrollContainer.querySelectorAll('[data-generation-id]');
      elements.forEach((element) => {
        if (element.getAttribute('data-generation-id') === (generation_output_id || 'original')) {
          const containerWidth = scrollContainer.offsetWidth;
          const elementLeft = element.offsetLeft;
          const elementWidth = element.offsetWidth;
          const currentScrollLeft = scrollContainer.scrollLeft;
          const elementRight = elementLeft + elementWidth;
          const containerRight = currentScrollLeft + containerWidth;
          const isInView = elementLeft >= currentScrollLeft * 2 && elementRight <= containerRight / 2;
          if (!isInView) {
            const scrollLeft = elementLeft - containerWidth / 2 - elementWidth * 2;
            scrollContainer.scrollTo({ left: scrollLeft, behavior: 'smooth' });
          }
        }
      });
    } catch (_) {}
  }, []);

  useEffect(() => {
    handleSelectGeneration(selectedGenOutputId);
    setTimeout(() => {
      scrollToGeneration(selectedGenOutputId || 'original');
    }, 100);
  }, [selectedGenOutputId]);

  useEffect(() => {
    const lastGeneration = mediaDetail?.generations?.[mediaDetail.generations.length - 1];
    const lastOutputs = lastGeneration?.generation_output_ids;
    const lastOutput = lastOutputs?.length > 0 ? lastOutputs[lastOutputs.length - 1] : null;
    const outputId = lastOutput?._id;
    const isGenProcessing = ['created', 'processing'].includes(
      lastGeneration?.status || lastGeneration?.job_status
    );
    const isGenError = lastGeneration?.status === 'error' || lastGeneration?.job_status === 'error';

    if (outputId) {
      const previewUrl = lastOutput?.preview_url;
      if (previewUrl) {
        const img = new Image();
        img.src = previewUrl;
        img.onload = () => setMediaUrl(previewUrl);
      }
      setSelectedGenId(lastGeneration._id);
      onSelectGenerationId?.(outputId);
    } else if (isGenProcessing && !isGenError) {
      handleEmptyGenerationOutputId('generating');
    }

    const scrollDiv = scrollRef.current;
    if (scrollDiv) {
      scrollDiv.scrollLeft = scrollDiv.scrollWidth;
    }
  }, [mediaDetail?.generations]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.contentEditable === 'true'
      ) {
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();

        const allGenerationIds = [null];
        mediaDetail?.generations?.forEach((generation) => {
          generation?.generation_output_ids?.forEach((output) => {
            if (output._id) {
              allGenerationIds.push(output._id);
            } else {
              allGenerationIds.push('generating');
            }
          });
        });

        if (allGenerationIds.length <= 1) return;

        const currentIndex = allGenerationIds.findIndex(
          (id) => id === selectedGenOutputId || id === 'generating'
        );
        let newIndex;
        if (event.key === 'ArrowLeft') {
          newIndex = currentIndex > 0 ? currentIndex - 1 : allGenerationIds.length - 1;
        } else {
          newIndex = currentIndex < allGenerationIds.length - 1 ? currentIndex + 1 : 0;
        }

        const newGenerationId = allGenerationIds[newIndex];
        handleSelectGeneration(newGenerationId);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedGenOutputId, mediaDetail?.generations, handleSelectGeneration]);

  const isRightPanelGenerating =
    selectedGenId === 'generating' || selectedGenOutputId === 'generating';

  useEffect(() => {
    if (!isRightPanelGenerating || !mediaDetail?._id) return;
    const id = window.setInterval(() => {
      setThoughtStreamSyncTick((t) => t + 1);
    }, 450);
    return () => window.clearInterval(id);
  }, [isRightPanelGenerating, mediaDetail?._id]);

  const lastGeneratedOrOriginalDisplayUrl = getLastGeneratedPreviewDisplayUrl(mediaDetail);

  const matchedGen = mediaDetail?.generations?.find((gen) =>
    gen?.generation_output_ids?.some((o) => o._id === selectedGenOutputId)
  );
  const inputSourceId = matchedGen?.input_source?.[0]?.ref_id;
  const beforePreviewUrl =
    mediaDetail?.generations
      ?.flatMap((g) => g.generation_output_ids || [])
      ?.find((o) => o._id === inputSourceId)?.preview_url ||
    mediaDetail?.imgSrc ||
    mediaDetail?.url;

  const generatingBackdropTitle = useMemo(() => {
    let displayPos = 0;
    try {
      displayPos = parseInt(localStorage.getItem(`typing_display_pos_${mediaId}`) || '0', 10);
    } catch (_) {}
    return getActiveThinkingLabelAtDisplayPos(thoughtsText, displayPos) || 'Generating';
  }, [thoughtsText, mediaId, thoughtStreamSyncTick]);

  const hasGenerations = (mediaDetail?.generations?.length || 0) > 0;

  const handleDownload = useCallback(() => {
    if (!mediaUrl) return;
    const a = document.createElement('a');
    a.href = mediaUrl;
    a.download = 'reimagine-design.jpg';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [mediaUrl]);

  const handleShare = useCallback(async () => {
    if (!mediaUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'REimagineHome Design', url: mediaUrl });
      } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(mediaUrl);
      } catch (_) {}
    }
  }, [mediaUrl]);

  const buildThumbButtons = () => {
    const thumbs = [
      h('button', {
        type: 'button',
        key: 'original',
        class: `mcm-thumb-item${!selectedGenOutputId ? ' mcm-thumb-item--selected' : ''}`,
        'data-generation-id': 'original',
        onClick: () => handleSelectGeneration(null),
      },
        h(GenerationUI, {
          item: {
            preview_url: mediaDetail?.url || mediaDetail?.imgSrc,
            action_name: 'Original',
          },
          isError: false,
          isProcessing: false,
          isSelected: !selectedGenOutputId,
          originalImageUrl: mediaDetail?.url,
        })
      ),
    ];

    (mediaDetail?.generations || []).forEach((generation) => {
      const isError = generation?.status === 'error';
      const isProcessing = ['created', 'processing'].includes(
        generation?.status || generation?.job_status
      );
      (generation?.generation_output_ids || []).forEach((item, idx) => {
        const scrollId = item?._id || (isProcessing && !isError ? 'generating' : undefined);
        const isPlaceholderSelected =
          selectedGenOutputId === 'generating' && isProcessing && !isError && !item?._id;
        thumbs.push(
          h('button', {
            type: 'button',
            key: item?._id || `gen-${idx}`,
            class: `mcm-thumb-item${(item?._id && selectedGenOutputId === item._id) || isPlaceholderSelected ? ' mcm-thumb-item--selected' : ''}${isError || isProcessing ? ' mcm-thumb-item--wash' : ''}`,
            'data-generation-id': scrollId,
            onClick: () => {
              if (!isError && !isProcessing && item?._id) {
                handleSelectGeneration(item._id);
              } else {
                handleSelectGeneration('generating');
              }
            },
          },
            h(GenerationUI, {
              item,
              isError,
              isProcessing,
              isSelected:
                (item?._id && selectedGenOutputId === item._id) || isPlaceholderSelected,
              originalImageUrl: lastGeneratedOrOriginalDisplayUrl,
            })
          )
        );
      });
    });

    return thumbs;
  };

  return (
    h('div', { class: 'mcm-panel-right' },
      h('div', {
        ref: panelRef,
        class: `mcm-panel-right__stage${hasGenerations ? ' mcm-panel-right__stage--with-gens' : ''}`,
      },
        h('div', { class: 'mcm-panel-right__inner' },
          h('div', {
            class: 'mcm-preview-wrap',
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
          },
            !showCompareImages
              ? h('div', { class: 'mcm-preview-main mcm-preview-main--centered' },
                  isRightPanelGenerating
                    ? h(GeneratingProcessingBackdrop, {
                      imageUrl: lastGeneratedOrOriginalDisplayUrl || mediaUrl,
                      title: generatingBackdropTitle,
                      radialBackdropOnly: true,
                      class: 'mcm-preview-backdrop-full',
                    })
                    : mediaUrl
                    ? h('img', {
                      src: mediaUrl,
                      alt: 'aiGenerations',
                      class: 'mcm-preview-img',
                      loading: 'lazy',
                    })
                    : null
                )
              : h('div', { class: 'mcm-compare-wrap' },
                  h(CompareSlider, {
                    beforeSrc: beforePreviewUrl,
                    afterSrc: mediaUrl,
                    beforeLabel: 'Original',
                    afterLabel: 'Reimagined',
                  })
                ),

            hasGenerations && !isRightPanelGenerating &&
              h(FloatingButtons, {
                showCompareImages,
                setShowCompareImages,
                hasGenerations,
                disable: !selectedGenOutputId && hasGenerations,
                isHovered,
                onDownload: handleDownload,
                onShare: handleShare,
              })
          )
        )
      ),

      h('div', { class: `mcm-bottom-thumbs${hasGenerations ? '' : ' mcm-bottom-thumbs--empty'}` },
        hasGenerations
          ? h('div', { class: 'mcm-thumbs-block' },
              h('p', { class: 'mcm-recent-title' }, 'Recent designs'),
              h('div', { class: 'mcm-thumbs-scroll', ref: scrollRef },
                buildThumbButtons()
              )
            )
          : mediaDetail?.messages?.length && !mediaDetail?.generations?.length
          ? h('div', { class: 'mcm-no-designs' },
              h('p', { class: 'mcm-no-designs__title' }, 'No designs yet!'),
              h('p', { class: 'mcm-no-designs__sub' }, 'Start creating designs to see them here')
            )
          : h('div', { class: 'mcm-thumbs-loading' })
      )
    )
  );
}
