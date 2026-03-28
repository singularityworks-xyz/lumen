defmodule PresenceWeb.ErrorJSONTest do
  use ExUnit.Case, async: true

  alias PresenceWeb.ErrorJSON

  describe "render/2" do
    test "renders 404 error" do
      result = ErrorJSON.render("404.json", %{})
      assert result == %{errors: %{detail: "Not Found"}}
    end

    test "renders 500 error" do
      result = ErrorJSON.render("500.json", %{})
      assert result == %{errors: %{detail: "Internal Server Error"}}
    end

    test "renders 400 error" do
      result = ErrorJSON.render("400.json", %{})
      assert result == %{errors: %{detail: "Bad Request"}}
    end

    test "renders 401 error" do
      result = ErrorJSON.render("401.json", %{})
      assert result == %{errors: %{detail: "Unauthorized"}}
    end

    test "renders 403 error" do
      result = ErrorJSON.render("403.json", %{})
      assert result == %{errors: %{detail: "Forbidden"}}
    end

    test "renders 422 error" do
      result = ErrorJSON.render("422.json", %{})
      assert result[:errors][:detail] != nil
    end

    test "renders custom status codes" do
      result = ErrorJSON.render("503.json", %{})
      assert result == %{errors: %{detail: "Service Unavailable"}}
    end

    test "ignores assigns parameter" do
      result = ErrorJSON.render("404.json", %{some: "assigns"})
      assert result == %{errors: %{detail: "Not Found"}}
    end

    test "returns map with errors key" do
      result = ErrorJSON.render("500.json", %{})
      assert Map.has_key?(result, :errors)
      assert Map.has_key?(result.errors, :detail)
    end
  end
end
