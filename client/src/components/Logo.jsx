const Logo = ({
  imgClassName = "w-10 h-10",
  textClassName = "text-lg font-semibold text-gray-900",
}) => (
  <>
    <img src="/butterfly-logo.png" alt="My Health School" className={`${imgClassName} object-contain shrink-0`} />
    <span className={`${textClassName} whitespace-nowrap`}>My Health School</span>
  </>
);

export default Logo;
