import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model.js";

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.REDIRECT_URI,
    },
    async function verify(accessToken, refreshToken, profile, done) {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;

        let user = await User.findOne({ googleId });
        if (!user) {
          user = await User.create({
            googleId,
            name: profile.displayName,
            email,
            avatar: profile.photos?.[0]?.value,
          });
        } else {
          user.avatar = profile.photos?.[0]?.value || user.avatar;
          user.name = profile.displayName || user.name;
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
