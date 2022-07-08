import { Link } from "@remix-run/react";

export default function Index() {
  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-col text-center w-full mb-12">
          <h1 className="sm:text-3xl text-2xl font-medium mb-4 text-gray-900">Home Page</h1>
          <p className="lg:w-2/3 mx-auto leading-relaxed text-base">This page is public.</p>
        </div>
        <div className="flex items-center justify-center space-x-4">
          <Link to="profile" className="btn">
            Profile
          </Link>
          <Link to="admin" className="btn">
            Admin
          </Link>
        </div>
      </div>
    </section>
  );
}
