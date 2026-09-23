import { ArrowRight, Box } from "lucide-react";
import Button from "./ui/button";
import { useOutletContext } from "react-router";

const Navbar = () => {
  const { isSignedIn, userName, signIn, signOut } = useOutletContext<AuthContext>()

  const handleAuthClick = async () => {
    if(isSignedIn) {
      try {
          await signOut();
      } catch (e) {
          console.error(`Puter Sign out failed: ${e}`);
      }

      return;
    }

    try{
       await signIn();
    } catch (e) {
        console.error(`Puter sign in failed: ${e} `);
    }
    
  };

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
                  {userName ? `Hi, ${userName}`: 'Signed in'}
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