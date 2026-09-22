import { VueIgnore } from '../../util';
interface TabsEmitsProps {
  onChange?: (key: string) => void;
  'onUpdate:activeKey'?: (key: string) => void;
}
interface ButtonEmitsProps {
  onClick?: (e: MouseEvent) => void;
}
interface Base {
  activeKey?: string;
  size?: 'small' | 'large';
}
interface TabsProps extends Base, TabsEmitsProps {
  centered?: boolean;
}
interface ButtonProps extends Base, VueIgnore<ButtonEmitsProps> {
  loading?: boolean;
}
export { Base, ButtonEmitsProps, ButtonProps, TabsEmitsProps, TabsProps };
