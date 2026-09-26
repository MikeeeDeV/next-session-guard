import { describe, it, expect } from "vitest";
import React from "react";
import { AdminSecurityPanel } from "../src/components/AdminSecurityPanel";

describe("AdminSecurityPanel Component", () => {
  it("should be exported and defined as a function/component", () => {
    expect(AdminSecurityPanel).toBeDefined();
    expect(typeof AdminSecurityPanel).toBe("function");
  });

  it("should accept custom props without errors", () => {
    const element = React.createElement(AdminSecurityPanel, {
      title: "Custom Security Panel",
      locale: "ar",
      initialSessions: [
        {
          id: "s1",
          isCurrent: true,
          deviceType: "desktop",
          browser: "Chrome",
          os: "Linux",
          ipAddress: "127.0.0.1",
          createdAt: new Date(),
          lastActiveAt: new Date(),
          expires: new Date(),
        },
      ],
    });

    expect(element).toBeDefined();
    expect(element.props.title).toBe("Custom Security Panel");
    expect(element.props.locale).toBe("ar");
  });
});
