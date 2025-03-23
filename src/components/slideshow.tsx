"use client";
import {
  ReactElement,
  createContext,
  useContext,
  useState,
  Children,
  cloneElement,
  JSX,
  useEffect,
  useRef,
} from "react";
import { motion } from "motion/react";

interface SlideshowContextType {
  animationDistance: number;
  animationTime: number;
  width: number;
  height: number;
}
const SlideshowContext = createContext({
  animationDistance: 20,
  animationTime: 20,
  width: 0,
  height: 0,
} as SlideshowContextType);
const FrameContext = createContext(false);
const KeyFrameContext = createContext(false);

export interface FrameProps {
  children: ReactElement<ElementProps>[];
  isCurrent?: boolean;
  isKeyFrame?: boolean;
}

export interface SlideshowProps {
  advanceTime?: number;
  inBetweenTime?: number;
  animationDistance?: number;
  animationTime?: number;
  previewFrame?: number | null;
  children: ReactElement<FrameProps>[];
}

export interface ElementProps {
  children: JSX.Element;
  x: number;
  y: number;
  animationDirection: string | AnimationDirection;
  width: number;
  height: number;
}

export interface AnimationDirection {
  x: number;
  y: number;
}

function createAnimationDirection(x: number, y: number): AnimationDirection {
  return { x: x, y: y };
}

export const customAnimationDirection = createAnimationDirection;

export function Slideshow({
  advanceTime = 7,
  animationDistance = 20,
  inBetweenTime = 0.2,
  animationTime = 1,
  previewFrame = null,
  children,
}: SlideshowProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [animateIn, setAnimateIn] = useState(true);
  const timeouts = useRef<NodeJS.Timeout[]>([]); // Track timeouts
  const containerRef = useRef<HTMLDivElement>(null); // FIXME: we need to wait until this is set before rendering things.
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setSize({ width: width, height: height });
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (previewFrame == null) {
      const scheduleFrame = () => {
        // Timeout to start animating out
        timeouts.current.push(
          setTimeout(() => {
            setAnimateIn(false);

            // Timeout for in-between state
            timeouts.current.push(
              setTimeout(() => {
                // Timeout to advance slide
                timeouts.current.push(
                  setTimeout(() => {
                    setCurrentFrame(
                      (prevFrame) => (prevFrame + 1) % Children.count(children)
                    );
                    setAnimateIn(true);

                    // Schedule next cycle
                    scheduleFrame();
                  }, inBetweenTime * 1000)
                );
              }, animationTime * 1000)
            );
          }, advanceTime * 1000)
        );
      };

      scheduleFrame();

      return () => {
        // Cleanup timeouts when component unmounts
        timeouts.current.forEach(clearTimeout);
        timeouts.current = [];
      };
    } else {
      setCurrentFrame(previewFrame);
    }
  }, [advanceTime, animationTime, children, inBetweenTime, previewFrame]); // Run effect when `children` change

  return (
    <SlideshowContext
      value={{
        animationDistance,
        animationTime,
        width: size.width,
        height: size.height,
      }}
    >
      <div ref={containerRef} className="h-full w-full">
        {Children.map(children, (child, index) =>
          cloneElement(child, {
            isCurrent: currentFrame === index && animateIn,
            isKeyFrame: index === (previewFrame ?? 0),
          })
        )}
      </div>
    </SlideshowContext>
  );
}
export function Frame({ children, isCurrent, isKeyFrame }: FrameProps) {
  if (isCurrent == null || isKeyFrame == null) {
    throw new Error("Frame must be a child of Slideshow.");
  }
  return (
    <FrameContext value={isCurrent}>
      <KeyFrameContext value={isKeyFrame}>
        <div className="fixed h-full w-full">{children}</div>
      </KeyFrameContext>
    </FrameContext>
  );
}

function calculateRelativePosition(pos: number, slideshowLength: number) {
  return slideshowLength * pos;
}

export function Element({
  children,
  x,
  y,
  width,
  height,
  animationDirection,
}: ElementProps) {
  let parsedAnimationDirection;
  const slideshowContext = useContext(SlideshowContext);
  const isCurrent = useContext(FrameContext);
  const isKeyFrame = useContext(KeyFrameContext);
  const elementRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const updateSize = () => {
      if (elementRef.current) {
        const { width, height } = elementRef.current.getBoundingClientRect();
        setSize({ width: width, height: height });
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    if (elementRef.current) {
      resizeObserver.observe(elementRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);
  if (typeof animationDirection === "object") {
    parsedAnimationDirection = animationDirection;
  } else {
    switch (animationDirection) {
      case "up":
        parsedAnimationDirection = createAnimationDirection(
          0,
          -slideshowContext.animationDistance
        );
        break;
      case "down":
        parsedAnimationDirection = createAnimationDirection(
          0,
          slideshowContext.animationDistance
        );
        break;
      case "left":
        parsedAnimationDirection = createAnimationDirection(
          -slideshowContext.animationDistance,
          0
        );
        break;
      case "right":
        parsedAnimationDirection = createAnimationDirection(
          slideshowContext.animationDistance,
          0
        );
        break;
      case "none":
        parsedAnimationDirection = createAnimationDirection(0, 0);
        break;
      default:
        throw new Error("Animation direction is invalid.");
    }
  }

  const relX = calculateRelativePosition(0.5, size.width);
  const relY = calculateRelativePosition(0.5, size.height);

  const iniPosX =
    calculateRelativePosition(
      x + parsedAnimationDirection.x,
      slideshowContext.width
    ) - relX;
  const iniPosY =
    calculateRelativePosition(
      y + parsedAnimationDirection.y,
      slideshowContext.height
    ) - relY;
  const posX = calculateRelativePosition(x, slideshowContext.width) - relX;
  const posY = calculateRelativePosition(y, slideshowContext.height) - relY;

  const notCurrentState = {
    opacity: 0,
    x: iniPosX,
    y: iniPosY,
  };
  const currentState = { opacity: 1, x: posX, y: posY };
  const transition = {
    ease: "easeInOut",
    duration: slideshowContext.animationTime,
  };

  console.log(x, relX, posX, size.width, slideshowContext.width);

  return (
    <motion.div
      initial={isKeyFrame ? currentState : notCurrentState}
      animate={isCurrent ? currentState : notCurrentState}
      transition={{
        opacity: {
          duration: slideshowContext.animationTime,
          ease: "easeInOut",
        },
        x: transition,
        y: transition,
      }}
      className="absolute"
      style={{
        width: slideshowContext.width * width + "px",
        height: slideshowContext.height * height + "px",
      }}
      ref={elementRef}
    >
      {children}
    </motion.div>
  );
}
