import { ButterflyIcon } from "./icons";

const Logo = ({
  iconClassName = "w-7 h-7 text-teal-600",
  textClassName = "text-lg font-semibold text-gray-900",
}) => (
  <>
    <ButterflyIcon className={iconClassName} />
    <span className={textClassName}>My Health School</span>
  </>
);

export default Logo;
