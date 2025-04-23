import NavMenu from '../components/NavMenu';

export default function NavMenuWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavMenu />
      {children}
    </>
  );
}
