import { Link } from 'react-router-dom';

export default function NavBar() {
  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="navbar-mark">LH</span>
          <span>Logan&nbsp;Connect</span>
        </Link>
        <span className="navbar-tag">National Ave &amp; beyond · est. by the neighborhood</span>
      </div>
    </header>
  );
}
