# Project Idea
- A website which allows users to create their own drawings by drawing on an empty white canvas
- The canvas should have a toolbar with different drawing tools (e.g., pencil, eraser, shapes) 
- The canvas also has the ability to change the color and thickness of the drawing tools
- You can download your finished drawing as an image file
- You can upload an image file and edit it on the canvas

# Technologies to Use
## Frontend
- HTML, CSS, JavaScript and Bootstrap for the user interface and responsive design
- It's a multi-page application with a homepage, a drawing page and an admin dashboard(for the admins)
- Toast notifications for user feedback (e.g., when a drawing is saved or an error occurs) and improved UX
- Use icons for enhanced user experience
- The overall design should be simple, interactable and intuitive, with a focus on usability and accessibility as well as putting some creative and artistic elements to make it visually appealing and enhance the artistic vibe.
- Use modular design principles to keep the code organized and maintainable with a Vite server for development and build process

## Backend
- Supabase connected through an MCP server
- Store supabase migrations here locally and DO NOT edit the already existing ones. If you need to make changes, create a new migration file with a timestamp in the name (e.g., `2024-06-01T12-00-00-create-drawings-table.sql`)
- The backend will handle user authentication, saving drawings to the database, and retrieving drawings for display on the frontend
- Implement RLS policies where users can only access their own drawings and galleries, and shared galleries can only be accessed by the users they are shared with. Admins will have access to all data.

# App Functionality
## Guest Mode
- Users can use the app in guest mode without signing up, but they will have limited functionality (e.g., they cannot save or share their drawings but they can download them)
## User Mode
- Users can register and log in which gives them access to additional features: they can save their drawings, share them with others and even create their own "galleries"
- A "gallery" is a folder which consists of drawings. Users can create multiple galleries and put their drawings in them or move them around, delete specific drawings (outside or inside a gallery) or delete the entire gallery (which automatically deletes all drawings inside it)
- Users can have a drawing outside a gallery
- Users can share a gallery with a specific user (by searching them up) which gives them access to view the gallery and all drawings inside but cannot modify or edit them
- Users can upload their own profile picture and change their username
- Users can set their account to "private" which won't make them visible on the search bar but their shared drawings will be visible through the link

## Admin Mode
- Admins have full access to all user accounts, their drawings and their galleries. They can modify them (create, edit, delete)
- They have their own admin dashboard where everything is visualized: all users and their associated drawings and galleries. They can make an account private or public.

