Privacy Policy for Dino's Adventure: Platformer Game

_Last updated: 12 November 2026_

This Privacy Policy describes how personal information is collected, used, and disclosed when you play Dino's Adventure: Platformer Game (referred to as "the Game").

### Information We Collect

When you play Dino's Adventure, we may collect certain information automatically, including:

- Device Information: We collect information about the device you use to access the Game, such as the device model, operating system version, unique device identifiers, and mobile network information.
- Log Information: We collect log information when you interact with the Game, including the date and time of your actions, the features you use, and any errors that occur during gameplay.
- Gameplay Information: We may collect information about your gameplay activities, such as your progress, achievements, and the coins and looks you earn in the Game.

### Accounts and Shared Worlds

Signing in is optional and only needed for the Worlds feature (creating and sharing worlds). If you sign in:

- Account Information: your email address, your display name and, for Google sign-in, your Google account identifier, stored with Firebase Authentication (Google). Your password, if you use one, is handled by Firebase Authentication and never stored by the Game.
- Worlds You Share: the worlds you create are public. Each one is stored in Cloud Firestore (Google) with your display name and an account identifier, and is shown to every player. Your email address is never shown to other players.
- World Descriptions: the description you type to create a world is sent to Anthropic's Claude API to design the world. It is not stored with the world or shown to other players.

You can sign out at any time in Settings, and delete your account there too: your account and its sign-in details are deleted, and the worlds you shared stay public but are credited to "Anonymous" with no account identifier. To remove a world you shared, contact us at the address below.

### Leaderboards

When you finish a daily challenge or an endless run, your best run goes on that leaderboard (one per day for the daily challenge, one for all time for endless), anonymous accounts included. Each entry is stored in Cloud Firestore (Google) and holds an account identifier, the name shown on the board (your display name, or a generated name such as "Swift Raptor 42" for an anonymous account), your score and your time in seconds, and for endless the level you reached and that run's level seed. New entries store no date or time of day of the run. Our server keeps a few times for itself, never shown to players: entries saved before this change still carry when they were last improved, a run's start and finish times are kept for about three days to check that the run is genuine, and recent submission times are kept to limit how often scores can be sent.

The leaderboards are public: every player sees the top 50 entries' names, scores, times and endless levels, each with its account identifier so the board can show that player's profile. Players' devices never read the stored entries themselves: the Game asks our server for a board and gets back only the top 50 and your own entry, with only those fields: never the level seed, and never when an entry was created or last changed. The top 50 is refreshed at most once a minute, so watching a board can't tell exactly when someone improved. Deleting your account in Settings deletes your entries too.

### Leaderboard Profile

Every player with an account, anonymous accounts included, has a small public profile, stored in Cloud Firestore (Google) so other players can see it on the leaderboards. It holds:

- Your worn skin, hat and companion.
- The UTC day you last opened the Game (a date only, never a time).

It holds nothing else: no name, email address or time of day. The profile is public: it is shown to every player on the leaderboards, next to your display name. Players' devices never read the stored profile itself: the leaderboard asks our server for the profiles of the players it shows, and gets back only the skin, hat, companion and day above, never when the profile was created or last changed.

To hide when you were last online, open Settings in the Game and switch off "Show when I was last online": the day is then deleted and none is stored until you switch it on again. The switch belongs to your account, not to one device: it is saved with your account's progress, so every device you play on with that account follows it as soon as it syncs that progress, and erasing your progress doesn't turn it back on. Your worn skin, hat and companion stay shown.

Deleting your account in Settings deletes your profile too.

### Daily Reminders

Reminders are off until you switch on "Daily reminder" in Settings, which asks your device for permission to show notifications. When you switch them on, we store, with your account in Cloud Firestore (Google):

- Your device's push token from Firebase Cloud Messaging (Google), or from Apple's push service in the iPhone app, so a reminder can reach that device.
- Your time zone, so a reminder arrives at a sensible time of your day.
- The last day a reminder was sent, so you get at most one a day.

This is never shown to other players, and players' devices can't read it. Switching reminders off removes that device; deleting your account deletes all of it.

### Anonymous Usage Statistics

The Game sends anonymous usage events to Google Analytics (through Firebase Analytics, by Google). The events carry no name, email address or account identifier. The events are:

- `app_open`: whether you have played before and how many days ago you first opened the Game.
- `mode_start`: which mode you started (story, daily, endless or custom).
- `level_start`: the mode and the level you started.
- `level_complete`: the mode, the level, how many seconds it took and how many stars you earned.
- `level_fail`: the mode, the level and how many seconds you lasted.
- `daily_complete`: your score, your time and your rank on the daily challenge.
- `leaderboard_open`: that you opened the leaderboard.
- `share`: whether you shared your result with the share button or copied it.

Google Analytics also receives the usual technical details of your browser, such as its language, screen size and approximate location. To turn this off, open Settings in the Game and switch off "Share anonymous usage stats": the analytics code is then no longer loaded and nothing is sent.

### How We Use Your Information

We may use the information collected to:

- Provide and maintain the Game;
- Improve and optimize the Game's performance and user experience;
- Analyze trends and user behavior to understand how players interact with the Game;
- Keep your progress, looks and settings in step across the devices you play on;
- Communicate with you, including responding to your inquiries and providing customer support;
- Detect, prevent, and address technical issues or fraudulent activity.

### Sharing Your Information

We may share your information with third parties for the following purposes:

- Service Providers: We may engage third-party companies or individuals to perform services on our behalf, such as hosting, analytics, and customer support.
- Legal Compliance: We may disclose your information if required to do so by law or in response to valid legal requests, such as subpoenas or court orders.
- Business Transfers: If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.

### Data Retention

We will retain your information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.

### Your Choices

You can choose to opt-out of certain data collection and use by adjusting your device settings or by contacting us directly. In the Game's Settings you can switch off "Show when I was last online" (your leaderboard profile then shows no day) and "Share anonymous usage stats". However, please note that opting out may impact your ability to use certain features of the Game.

### Children's Privacy

Dino's Adventure is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe that we have inadvertently collected information from a child under 13, please contact us immediately.

### Terms of Service

Your use of the Game is also governed by our [Terms of Service](/terms).

### Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by posting the new Privacy Policy on this page.

### Contact Us

If you have any questions or concerns about this Privacy Policy or our practices regarding your personal information, please contact us at [panditankit1995@gmail.com](mailto:panditankit1995@gmail.com).

By playing Dino's Adventure, you agree to the collection and use of information in accordance with this Privacy Policy.
