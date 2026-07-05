import { StorySection } from 'typing-language-learning';
const noop = () => {};
export const Default = () => (
  <StorySection storyId="travel" mode="both" bottomTab="records" focusSection="story"
    onStoryIdChange={noop} onModeChange={noop} onStart={noop} onBottomTabChange={noop} onFocusSection={noop} />
);
