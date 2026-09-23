import { ArrowRight, Box } from "lucide-react";
import Button from "./ui/button";

const Navbar = () => {
  const isSignedIn = false;
  const username = 'Joseph';
  const handleAuthClick = async () => {};

  return (
    <header className="navbar">
      <nav className="inner">
        <div className="left">
          <div className="brand">
            <Box className="logo" />
            <span className="name">ArchVision</span>
          </div>

          <div className="links" aria-label="Main navigation">
            <a href="#">Product</a>
            <a href="#">Pricing</a>
            <a href="#">Community</a>
            <a href="#">Enterprise</a>
          </div>
        </div>

        <div className="actions">
          {isSignedIn ? (
              <>
                <span className="greeting">
                  {username ? `Hi, ${username}`: 'Signed in'}
                </span>

                <Button size="sm" onClick={handleAuthClick} className="btn">
                  Log Out 
               </Button>
            
            </>

          ) : (
              <>
                  <Button onClick={handleAuthClick} size="sm" variant="ghost">
                    Log In

                  </Button>

                  <a href="#upload" className="cta">Get Started</a>
              
              </>  
          )}
         
         
        </div>
      </nav>
    </header>
  );
};

export default Navbar;